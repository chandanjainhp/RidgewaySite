import { redirect } from "next/navigation";

export default function RootPage() {
  // Per design system, base page automatically jumps to investigation
  redirect('/investigate');
}
