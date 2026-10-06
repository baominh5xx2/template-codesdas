import type { Metadata } from "next";
import ContentPage, { generateMetadata as generateSlugMetadata } from "./[...slug]/page";

export async function generateMetadata(): Promise<Metadata> {
  return generateSlugMetadata({
    params: Promise.resolve({ slug: [] }),
    searchParams: Promise.resolve({}),
  });
}

export default async function HomePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <ContentPage
      params={Promise.resolve({ slug: [] })}
      searchParams={props.searchParams}
    />
  );
}
