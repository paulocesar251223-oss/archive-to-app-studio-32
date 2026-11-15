import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/')({ head: () => pageHead('SOCHI Slots', 'Access your SOCHI Slots account.'), component: AuthScreen });
