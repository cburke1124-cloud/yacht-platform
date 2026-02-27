import { redirect } from 'next/navigation';

interface SearchPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const params = new URLSearchParams();

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }

    if (value) {
      params.append(key, value);
    }
  });

  const queryString = params.toString();
  redirect(queryString ? `/listings?${queryString}` : '/listings');
}
