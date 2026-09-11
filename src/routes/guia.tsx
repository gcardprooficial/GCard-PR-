import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guia")({
  component: GuideLayout,
});

function GuideLayout() {
  return <Outlet />;
}
