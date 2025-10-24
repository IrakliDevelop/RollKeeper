# Password Reset Implementation Plan
## RollKeeper - Supabase Hybrid Approach

### 📋 Overview

This document outlines the implementation plan for adding password reset functionality to RollKeeper using a hybrid approach that leverages Supabase's email capabilities while maintaining our existing custom JWT authentication system.

### 🎯 Goals

- **Primary**: Enable users to reset forgotten passwords via email
- **Secondary**: Maintain existing custom auth system integrity
- **Tertiary**: Provide secure, user-friendly password recovery experience

### 🏗️ Architecture Decision: Hybrid Approach

**Why Hybrid?**
- ✅ Keep existing custom JWT auth system working
- ✅ Leverage Supabase's robust email infrastructure
- ✅ Minimal disruption to current authentication flow
- ✅ Easy to implement and maintain
- ✅ Future-proof (can migrate to full Supabase Auth later)

**What we're NOT doing:**
- ❌ Full migration to Supabase Auth (too disruptive)
- ❌ Third-party email services (unnecessary complexity)
- ❌ Security questions (less secure than email)

---

## 🗄️ Database Schema Changes

### New Table: `password_reset_tokens`

```sql
-- Add to existing Supabase database via SQL Editor
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Add indexes for performance
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add RLS policies
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access reset tokens (no user access)
CREATE POLICY "Service role can manage reset tokens" ON password_reset_tokens
    FOR ALL USING (auth.role() = 'service_role');
```

### Schema Integration

The new table integrates seamlessly with existing `users` table:
- **Foreign Key**: `user_id` → `users(id)`
- **Cascade Delete**: When user is deleted, tokens are automatically cleaned up
- **No Breaking Changes**: Existing auth system remains untouched

---

## 🔧 Supabase Email Configuration

### Step 1: Enable Email Auth in Supabase Dashboard

1. Go to **Authentication** → **Settings** → **Email**
2. Enable "Enable email confirmations" (temporarily for setup)
3. Configure custom SMTP (optional) or use Supabase's default

### Step 2: Custom Email Templates

**Template Location**: Authentication → Email Templates → Password Reset

```html
<!-- Custom Password Reset Email Template -->
<h2>Reset Your RollKeeper Password</h2>

<p>Hi {{ .Email }},</p>

<p>You requested to reset your password for your RollKeeper account. Click the link below to create a new password:</p>

<p><a href="{{ .SiteURL }}/auth/reset-password?token={{ .Token }}">Reset Password</a></p>

<p>This link will expire in 30 minutes for security reasons.</p>

<p>If you didn't request this password reset, please ignore this email.</p>

<p>Happy adventuring!<br>
The RollKeeper Team</p>
```

### Step 3: Environment Variables

Add to `.env.local`:
```env
# Password Reset Configuration
PASSWORD_RESET_TOKEN_EXPIRY=1800  # 30 minutes in seconds
PASSWORD_RESET_MAX_REQUESTS=5     # Max requests per hour per email
SITE_URL=http://localhost:3000    # Your app URL
```

---

## 🛠️ API Implementation

### File Structure

```
src/app/api/auth/
├── login/route.ts          # Existing
├── register/route.ts       # Existing  
├── refresh/route.ts        # Existing
├── forgot-password/        # NEW
│   └── route.ts
└── reset-password/         # NEW
    └── route.ts
```

### API Endpoint 1: Request Password Reset

**File**: `src/app/api/auth/forgot-password/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateEmail } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // Validate input
    if (!email || !validateEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Rate limiting check (prevent spam)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentRequests } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString());

    if (recentRequests && recentRequests.length >= 5) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Find user by email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    // Always return success (don't reveal if email exists)
    if (!user) {
      return NextResponse.json({
        message: 'If that email exists, we sent a reset link.'
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store reset token
    await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        ip_address: request.ip,
        user_agent: request.headers.get('user-agent')
      });

    // Send email via Supabase Auth
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.SITE_URL}/auth/reset-password?token=${token}`,
    });

    return NextResponse.json({
      message: 'If that email exists, we sent a reset link.'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### API Endpoint 2: Reset Password

**File**: `src/app/api/auth/reset-password/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, validatePassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    // Validate input
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid password', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Find and validate token
    const { data: resetToken } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > new Date(resetToken.expires_at)) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Check if token was already used
    if (resetToken.used_at) {
      return NextResponse.json(
        { error: 'Reset token has already been used' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', resetToken.user_id);

    if (updateError) {
      throw updateError;
    }

    // Mark token as used
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    return NextResponse.json({
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 Frontend Implementation

### File Structure

```
src/app/auth/
├── page.tsx                    # Existing login/register
├── forgot-password/            # NEW
│   └── page.tsx
└── reset-password/             # NEW
    └── page.tsx

src/components/ui/auth/
├── AuthButton.tsx              # Existing
├── ForgotPasswordForm.tsx      # NEW
└── ResetPasswordForm.tsx       # NEW
```

### Component 1: Forgot Password Form

**File**: `src/components/ui/auth/ForgotPasswordForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setEmail(''); // Clear form
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {message && (
            <div className="text-green-600 text-sm">{message}</div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Component 2: Reset Password Form

**File**: `src/components/ui/auth/ResetPasswordForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - redirect to login with success message
        router.push('/auth?message=Password reset successful. Please log in.');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-red-600 text-center">
            Invalid reset link. Please request a new password reset.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>
          Enter your new password below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Page 1: Forgot Password Page

**File**: `src/app/auth/forgot-password/page.tsx`

```typescript
import Link from 'next/link';
import ForgotPasswordForm from '@/components/ui/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">RollKeeper</h1>
          <p className="mt-2 text-gray-600">Reset your password</p>
        </div>
        
        <ForgotPasswordForm />
        
        <div className="text-center">
          <Link 
            href="/auth" 
            className="text-blue-600 hover:text-blue-500 text-sm"
          >
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Page 2: Reset Password Page

**File**: `src/app/auth/reset-password/page.tsx`

```typescript
import { Suspense } from 'react';
import ResetPasswordForm from '@/components/ui/auth/ResetPasswordForm';

function ResetPasswordContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">RollKeeper</h1>
          <p className="mt-2 text-gray-600">Create your new password</p>
        </div>
        
        <ResetPasswordForm />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
```

### Update Existing Auth Page

**Modify**: `src/app/auth/page.tsx`

Add "Forgot Password?" link to the existing login form:

```typescript
// Add this link after the login form, before the register toggle
<div className="text-center">
  <Link 
    href="/auth/forgot-password"
    className="text-sm text-blue-600 hover:text-blue-500"
  >
    Forgot your password?
  </Link>
</div>
```

---

## 🔒 Security Considerations

### Token Security

- **Cryptographically Secure**: Using `crypto.randomBytes(32)` for token generation
- **Time-Limited**: 30-minute expiration window
- **Single-Use**: Tokens are marked as used after successful reset
- **Rate Limited**: Max 5 requests per hour per email address

### Privacy Protection

- **Email Enumeration Prevention**: Always return success message regardless of email existence
- **Secure Headers**: Store IP and User-Agent for audit trails
- **No Sensitive Data in URLs**: Tokens are in URL but not logged

### Database Security

- **Row Level Security**: RLS policies prevent unauthorized access
- **Foreign Key Constraints**: Automatic cleanup when users are deleted
- **Indexed Lookups**: Efficient queries with proper indexing

---

## 🧪 Testing Strategy

### Manual Testing Checklist

#### Happy Path
- [ ] User requests password reset with valid email
- [ ] Reset email is received within 2 minutes
- [ ] Reset link works and loads form
- [ ] New password is accepted and works for login
- [ ] Token is marked as used after successful reset

#### Error Handling
- [ ] Invalid email format shows appropriate error
- [ ] Non-existent email still shows success message
- [ ] Expired token shows appropriate error
- [ ] Used token shows appropriate error
- [ ] Rate limiting works after 5 requests
- [ ] Weak passwords are rejected

#### Security
- [ ] Reset tokens are not reusable
- [ ] Expired tokens cannot be used
- [ ] Password validation works correctly
- [ ] Rate limiting prevents spam

### Automated Testing

```typescript
// Example test structure
describe('Password Reset API', () => {
  it('should accept valid email and send reset email')
  it('should reject invalid email formats')
  it('should rate limit excessive requests')
  it('should validate reset tokens properly')
  it('should update password successfully')
  it('should prevent token reuse')
});
```

---

## 📦 Deployment Checklist

### Environment Variables
- [ ] `PASSWORD_RESET_TOKEN_EXPIRY` set in production
- [ ] `PASSWORD_RESET_MAX_REQUESTS` configured appropriately
- [ ] `SITE_URL` points to production domain
- [ ] Supabase email templates updated with production URLs

### Supabase Configuration
- [ ] Email templates configured with production branding
- [ ] SMTP settings verified (if using custom SMTP)
- [ ] RLS policies applied and tested
- [ ] Database migration executed successfully

### Security Review
- [ ] Rate limiting tested in production
- [ ] Email delivery confirmed working
- [ ] Password validation requirements documented
- [ ] Security headers configured

---

## 🚀 Implementation Timeline

### Phase 1: Database Setup (Day 1)
- [ ] Create password reset tokens table
- [ ] Apply RLS policies
- [ ] Test database schema

### Phase 2: API Development (Day 2-3)
- [ ] Implement forgot password endpoint
- [ ] Implement reset password endpoint
- [ ] Add rate limiting and validation
- [ ] Test API endpoints

### Phase 3: Frontend Development (Day 4-5)
- [ ] Create forgot password form
- [ ] Create reset password form
- [ ] Update existing auth page
- [ ] Test user flows

### Phase 4: Email Integration (Day 6)
- [ ] Configure Supabase email templates
- [ ] Test email delivery
- [ ] Verify email styling and links

### Phase 5: Testing & Polish (Day 7)
- [ ] Manual testing of all flows
- [ ] Security testing
- [ ] UI/UX refinements
- [ ] Documentation updates

---

## 🔧 Maintenance & Monitoring

### Regular Tasks

**Daily:**
- Monitor failed password reset attempts
- Check email delivery rates

**Weekly:**
- Clean up expired tokens (automated via cron job)
- Review rate limiting effectiveness

**Monthly:**
- Audit password reset usage patterns
- Update email templates if needed

### Monitoring Queries

```sql
-- Check recent password reset activity
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as reset_requests,
  COUNT(used_at) as successful_resets
FROM password_reset_tokens 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Find potential abuse patterns
SELECT 
  ip_address,
  COUNT(*) as requests,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request
FROM password_reset_tokens 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 10
ORDER BY requests DESC;
```

### Cleanup Job

```sql
-- Clean up expired tokens (run daily)
DELETE FROM password_reset_tokens 
WHERE expires_at < NOW() - INTERVAL '24 hours';
```

---

## 📚 Additional Resources

### Supabase Documentation
- [Supabase Auth Email Configuration](https://supabase.com/docs/guides/auth/auth-email)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

### Security Best Practices
- [OWASP Password Reset Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

### Next.js Integration
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

---

## ✅ Success Criteria

This implementation will be considered successful when:

1. **Functional**: Users can successfully reset their passwords via email
2. **Secure**: All security best practices are implemented and tested
3. **User-Friendly**: Clear error messages and intuitive user flow
4. **Reliable**: Email delivery works consistently
5. **Maintainable**: Code is well-documented and easy to modify
6. **Scalable**: System handles multiple concurrent reset requests

---

**Document Version**: 1.0  
**Last Updated**: October 14, 2025  
**Author**: AI Assistant  
**Status**: Ready for Implementation
