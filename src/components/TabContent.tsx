import React from "react";
import { marked } from "marked";

type TabContentProps = {
  loading: boolean;
  error: string | null;
  text: string;
  loadingText: string;
  isMarkdown?: boolean;
  id?: string;
};

export const TabContent: React.FC<TabContentProps> = ({
  loading,
  error,
  text,
  loadingText,
  isMarkdown = false,
  id = "lb-panel-body",
}) => {
  if (error) {
    return <>{error}</>;
  }

  // Only show the full-block loading text if we are loading AND have no text yet.
  // Otherwise, we let the text stream in.
  if (loading && !text) {
    return <>{loadingText}</>;
  }

  if (isMarkdown) {
    return (
      <div
        id={id}
        dangerouslySetInnerHTML={{ __html: marked.parse(text || "") }}
      />
    );
  }

  return <div id={id}>{text}</div>;
};
