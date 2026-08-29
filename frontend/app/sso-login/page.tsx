import SSOLoginClient from "./SSOLoginClient";

export default async function SSOLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ jwt?: string; username?: string; role?: string }>;
}) {
  const params = await searchParams;
  return <SSOLoginClient jwt={params.jwt} username={params.username} role={params.role} />;
}
