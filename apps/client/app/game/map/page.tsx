import { redirect } from 'next/navigation';

export default function MapRedirect() {
  redirect('/game?phase=city_map');
}
