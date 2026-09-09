type CenteredLoaderProps = {
  label: string;
};

export function CenteredLoader({ label }: CenteredLoaderProps) {
  return (
    <div className="centered-loader" role="status" aria-live="polite">
      <span className="centered-loader-spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
