import React from "react";
import EmptyState from "./EmptyState";
export default function ErrorState({ message = "We couldn't load this information. Please try again.", onRetry, onBack }) {
  return <EmptyState title="Something went wrong" message={message} icon="refresh-circle-outline" actionLabel={onRetry ? "Try Again" : undefined} onAction={onRetry} secondaryLabel={onBack ? "Go Back" : undefined} onSecondary={onBack} />;
}
