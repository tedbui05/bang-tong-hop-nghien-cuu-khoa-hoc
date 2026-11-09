import { ReviewView } from "@/components/ReviewView";
import { PreviewBar } from "@/components/PreviewBar";
import { parsePreviewState } from "@/lib/preview-state";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Duyệt bài" };

type Props = { searchParams: Promise<{ "trang-thai"?: string | string[] }> };

export default async function Page({ searchParams }: Props) {
  const state = parsePreviewState((await searchParams)["trang-thai"]);
  return (
    <>
      <PreviewBar path="/duyet-bai" state={state} />
      <ReviewView state={state} />
    </>
  );
}
