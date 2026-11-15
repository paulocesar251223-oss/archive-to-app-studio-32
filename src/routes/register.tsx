import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute('/register')({
  head: () => pageHead('Create account', 'Create your Obsidian Slots account with an optional referral code.'),
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    const ref = typeof search['ref'] === 'string' ? search['ref'].trim().toUpperCase() : '';
    return /^[A-Z0-9]{8}$/.test(ref) ? { ref } : {};
  },
  component: Register,
});

function Register() {
  const { ref } = Route.useSearch();
  return <AuthScreen mode="register" initialReferral={ref ?? ''} />;
}
