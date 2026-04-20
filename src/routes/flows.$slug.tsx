import { createFileRoute } from "@tanstack/react-router";
import { AnvlApp } from "@/components/anvl/AnvlApp";

export const Route = createFileRoute("/flows/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — ANVL` },
      { name: "description", content: `ANVL workspace for ${params.slug}.` },
    ],
  }),
  component: FlowWorkspace,
});

function FlowWorkspace() {
  const { slug } = Route.useParams();
  return <AnvlApp slug={slug} />;
}
