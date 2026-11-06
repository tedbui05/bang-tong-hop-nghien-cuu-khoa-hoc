import { CreateTableView } from "@/components/CreateTableView";
import { PreviewBar } from "@/components/PreviewBar";
import { parsePreviewState } from "@/lib/preview-state";

type Props = { searchParams: Promise<{ "trang-thai"?: string | string[] }> };

export default async function Page({ searchParams }: Props) {
  const state = parsePreviewState((await searchParams)["trang-thai"]);
  return (
    <>
      <PreviewBar path="/tao-bang" state={state} />
      <CreateTableView state={state} />
    </>
  );
}
