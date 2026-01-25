import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root traffic to the dashboard
  // The middleware will intercept this and force login if the user is not authenticated
  redirect('/dashboard');
}
