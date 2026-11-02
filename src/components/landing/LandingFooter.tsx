import Link from 'next/link';

const REPO_URL = 'https://github.com/IrakliDevelop/RollKeeper';

interface LandingFooterProps {
  links: { href: string; label: string }[];
}

export function LandingFooter({ links }: LandingFooterProps) {
  return (
    <footer className="border-divider bg-surface-raised border-t">
      <nav
        aria-label="Footer"
        className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      >
        <ul className="type-ui flex flex-wrap gap-x-5 gap-y-1">
          {links.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-body hover:text-heading inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={REPO_URL}
              className="text-body hover:text-heading inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              Source on GitHub
            </a>
          </li>
          <li>
            <a
              href={`${REPO_URL}/issues`}
              className="text-body hover:text-heading inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              Report a problem
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
