import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between">
        <Link href="/" className="text-xl font-bold">Music Platform</Link>
        <nav>
          <Link href="/login" className="mr-4">Login</Link>
          <Link href="/signup">Signup</Link>
        </nav>
      </div>
    </header>
  );
}