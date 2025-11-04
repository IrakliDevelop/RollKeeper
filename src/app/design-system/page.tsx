/**
 * Design System Showcase
 * 
 * A comprehensive demo page displaying all the new unified design system components.
 * This serves as both documentation and a visual testing ground.
 */

'use client';

import React, { useState } from 'react';
import { Save, Download, Upload, Mail, User, Search, CheckCircle, AlertCircle, Info, Star } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Switch } from '@/components/ui/forms/switch';
import { RadioGroupItem, RadioGroupField } from '@/components/ui/forms/radio-group';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/feedback/dialog-new';
import { Autocomplete, AutocompleteOption } from '@/components/ui/forms/Autocomplete';

export default function DesignSystemShowcase() {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [checkboxState, setCheckboxState] = useState(false);
  const [switchState, setSwitchState] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [selectValue, setSelectValue] = useState('');
  const [autocompleteValue, setAutocompleteValue] = useState('');

  const autocompleteOptions: AutocompleteOption[] = [
    { value: 'human', label: 'Human' },
    { value: 'elf', label: 'Elf' },
    { value: 'dwarf', label: 'Dwarf' },
    { value: 'halfling', label: 'Halfling' },
    { value: 'dragonborn', label: 'Dragonborn' },
    { value: 'gnome', label: 'Gnome' },
    { value: 'half-elf', label: 'Half-Elf' },
    { value: 'half-orc', label: 'Half-Orc' },
    { value: 'tiefling', label: 'Tiefling' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            RollKeeper Design System
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Unified component library built on Radix UI primitives
          </p>
        </div>

        {/* Buttons */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Buttons</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Variants</CardTitle>
              <CardDescription>Different button styles for various actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="success">Success</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="warning">Warning</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sizes</CardTitle>
              <CardDescription>Different button sizes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">Extra Small</Button>
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>With Icons & States</CardTitle>
              <CardDescription>Buttons with icons and loading states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button leftIcon={<Save className="h-4 w-4" />}>
                  Save
                </Button>
                <Button leftIcon={<Download className="h-4 w-4" />} variant="secondary">
                  Download
                </Button>
                <Button rightIcon={<Upload className="h-4 w-4" />} variant="outline">
                  Upload
                </Button>
                <Button loading>Loading...</Button>
                <Button disabled>Disabled</Button>
                <Button fullWidth variant="success">Full Width Button</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Inputs */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Inputs</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Input Variations</CardTitle>
              <CardDescription>Text inputs with labels, icons, and states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  label="Email Address"
                  placeholder="Enter your email"
                  type="email"
                  required
                />
                
                <Input
                  label="Username"
                  placeholder="Choose a username"
                  leftIcon={<User className="h-4 w-4" />}
                  helperText="This will be your public display name"
                />
                
                <Input
                  label="Search"
                  placeholder="Search..."
                  leftIcon={<Search className="h-4 w-4" />}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  clearable
                  onClear={() => setInputValue('')}
                />
                
                <Input
                  label="Error State"
                  placeholder="Invalid input"
                  error="This field is required"
                />
                
                <Input
                  label="Success State"
                  placeholder="Valid input"
                  variant="success"
                  helperText="Looks good!"
                />

                <div className="grid grid-cols-3 gap-4">
                  <Input size="sm" placeholder="Small" />
                  <Input size="md" placeholder="Medium" />
                  <Input size="lg" placeholder="Large" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Textarea */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Textarea</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Textarea Variations</CardTitle>
              <CardDescription>Multi-line text inputs with features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  label="Description"
                  placeholder="Enter a detailed description..."
                  helperText="Provide as much detail as possible"
                />
                
                <Textarea
                  label="Auto-resize Textarea"
                  placeholder="This textarea grows with content..."
                  autoResize
                  maxHeight={200}
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                />
                
                <Textarea
                  label="With Character Count"
                  placeholder="Limited to 200 characters"
                  showCharacterCount
                  maxLength={200}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Select */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Select</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Dropdowns</CardTitle>
              <CardDescription>Dropdown select menus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <SelectField
                  label="Choose an option"
                  value={selectValue}
                  onValueChange={setSelectValue}
                  required
                  helperText="Select one option from the list"
                >
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectField>
                
                <SelectField
                  label="With Icons & Descriptions"
                  value={selectValue}
                  onValueChange={setSelectValue}
                >
                  <SelectItem 
                    value="mail"
                    icon={<Mail className="h-4 w-4" />}
                    description="Send via email"
                  >
                    Email
                  </SelectItem>
                  <SelectItem 
                    value="save"
                    icon={<Save className="h-4 w-4" />}
                    description="Save to local storage"
                  >
                    Save
                  </SelectItem>
                  <SelectItem 
                    value="download"
                    icon={<Download className="h-4 w-4" />}
                    description="Download as file"
                  >
                    Download
                  </SelectItem>
                </SelectField>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Autocomplete */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Autocomplete</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Searchable Dropdowns</CardTitle>
              <CardDescription>Autocomplete inputs for large option lists</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Choose a race
                  </label>
                  <Autocomplete
                    options={autocompleteOptions}
                    value={autocompleteValue}
                    onChange={setAutocompleteValue}
                    placeholder="Search races..."
                  />
                  {autocompleteValue && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected: <span className="font-medium">{autocompleteValue}</span>
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Disabled State
                  </label>
                  <Autocomplete
                    options={autocompleteOptions}
                    value=""
                    onChange={() => {}}
                    placeholder="This is disabled..."
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Checkbox */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Checkbox</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Checkbox Variations</CardTitle>
              <CardDescription>Checkboxes with labels and descriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Checkbox
                  checked={checkboxState}
                  onCheckedChange={setCheckboxState}
                  label="Accept terms and conditions"
                />
                
                <Checkbox
                  label="With Description"
                  description="This checkbox has additional explanatory text below the label"
                />
                
                <Checkbox
                  label="With Icon"
                  icon={<Star className="h-4 w-4" />}
                  description="Mark as favorite"
                  variant="warning"
                />

                <div className="flex gap-6">
                  <Checkbox label="Small" size="sm" />
                  <Checkbox label="Medium" size="md" />
                  <Checkbox label="Large" size="lg" />
                </div>

                <div className="flex gap-4">
                  <Checkbox label="Primary" variant="primary" checked />
                  <Checkbox label="Success" variant="success" checked />
                  <Checkbox label="Danger" variant="danger" checked />
                  <Checkbox label="Warning" variant="warning" checked />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Switch */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Switch</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Toggle Switches</CardTitle>
              <CardDescription>On/off switches with labels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Switch
                  checked={switchState}
                  onCheckedChange={setSwitchState}
                  label="Enable notifications"
                  description="Receive email notifications about updates"
                />
                
                <Switch
                  label="Dark mode"
                  description="Enable dark theme"
                />

                <div className="flex gap-6">
                  <Switch label="Small" size="sm" />
                  <Switch label="Medium" size="md" />
                  <Switch label="Large" size="lg" />
                </div>

                <div className="flex gap-6">
                  <Switch label="Default" checked />
                  <Switch label="Success" variant="success" checked />
                  <Switch label="Danger" variant="danger" checked />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Radio Group */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Radio Group</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Radio Button Groups</CardTitle>
              <CardDescription>Single selection from multiple options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <RadioGroupField
                  label="Choose a plan"
                  value={radioValue}
                  onValueChange={setRadioValue}
                  required
                >
                  <RadioGroupItem value="option1" label="Free Plan" description="Basic features" />
                  <RadioGroupItem value="option2" label="Pro Plan" description="All features included" />
                  <RadioGroupItem value="option3" label="Enterprise" description="Custom solutions" />
                </RadioGroupField>

                <RadioGroupField
                  label="Card Style Options"
                  value={radioValue}
                  onValueChange={setRadioValue}
                >
                  <RadioGroupItem 
                    value="card1" 
                    label="Card Option 1" 
                    description="This is a card-style radio option"
                    variant="card"
                    icon={<CheckCircle className="h-5 w-5" />}
                  />
                  <RadioGroupItem 
                    value="card2" 
                    label="Card Option 2" 
                    description="Another card-style option"
                    variant="card"
                    icon={<Info className="h-5 w-5" />}
                  />
                </RadioGroupField>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Cards</h2>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
                <CardDescription>Standard card style</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This is a default card with standard border and padding.
                </p>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Bordered Card</CardTitle>
                <CardDescription>Thicker border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This card has a thicker, more prominent border.
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Elevated Card</CardTitle>
                <CardDescription>With shadow</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This card has a shadow for depth effect.
                </p>
              </CardContent>
            </Card>

            <Card variant="interactive">
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
                <CardDescription>Click me!</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This card responds to hover and can be clicked.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>With Footer</CardTitle>
                <CardDescription>Card with action buttons</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This card includes a footer section.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">Cancel</Button>
                <Button size="sm">Confirm</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Badges</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Badge Variations</CardTitle>
              <CardDescription>Labels for status, categories, and tags</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="danger">Danger</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="info">Info</Badge>
                  <Badge variant="neutral">Neutral</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge size="sm">Small</Badge>
                  <Badge size="md">Medium</Badge>
                  <Badge size="lg">Large</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge leftIcon={<CheckCircle className="h-3 w-3" />} variant="success">
                    Completed
                  </Badge>
                  <Badge leftIcon={<AlertCircle className="h-3 w-3" />} variant="warning">
                    Warning
                  </Badge>
                  <Badge rightIcon={<Star className="h-3 w-3" />} variant="primary">
                    Featured
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dialog/Modal */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Dialog/Modal</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Dialog Examples</CardTitle>
              <CardDescription>Modal dialogs for user interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>Small Dialog</Button>
                  </DialogTrigger>
                  <DialogContent size="sm">
                    <DialogHeader>
                      <DialogTitle>Small Dialog</DialogTitle>
                      <DialogDescription>
                        This is a small dialog for simple confirmations.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <p className="text-sm text-gray-600">
                        Are you sure you want to proceed with this action?
                      </p>
                    </DialogBody>
                    <DialogFooter>
                      <DialogTrigger asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogTrigger>
                      <Button>Confirm</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Large Dialog</Button>
                  </DialogTrigger>
                  <DialogContent size="lg">
                    <DialogHeader>
                      <DialogTitle>Large Dialog</DialogTitle>
                      <DialogDescription>
                        This dialog can contain more complex content.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <div className="space-y-4">
                        <Input label="Name" placeholder="Enter your name" />
                        <Input label="Email" type="email" placeholder="Enter your email" />
                        <Textarea label="Message" placeholder="Enter your message" />
                      </div>
                    </DialogBody>
                    <DialogFooter>
                      <DialogTrigger asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogTrigger>
                      <Button>Submit</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-8 text-center">
          <p className="text-sm text-gray-600">
            RollKeeper Design System • Built with Radix UI, Tailwind CSS, and Framer Motion
          </p>
        </div>
      </div>
    </div>
  );
}

