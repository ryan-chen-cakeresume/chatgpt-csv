import Head from "next/head";
import { Toaster } from "react-hot-toast";
import CSVEditor from "@/components/CSVEditor";

export default function Home() {
  return (
    <>
      <Head>
        <title>ChatGPT Powered CSV Editor</title>
      </Head>
      <div className="min-h-screen bg-gray-50 py-8">
        <CSVEditor />
        <Toaster position="top-right" />
      </div>
    </>
  );
}
