import { redirect } from 'next/navigation';

export default function HangoutRedirect() {
  redirect('/game?phase=hangout');
}
