import { DemoShell } from "../components/demo-shell";
import { loadDemoData } from "../lib/load-fixtures";

type HomePageProps = {
  searchParams?: {
    demo_fast_path?: string;
    auto_pass_checks?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const data = await loadDemoData();
  return (
    <DemoShell
      data={data}
      demoFastPath={searchParams?.demo_fast_path === "true"}
      autoPassChecks={searchParams?.auto_pass_checks === "true"}
    />
  );
}
