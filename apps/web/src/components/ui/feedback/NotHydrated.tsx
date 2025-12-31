// this component is used to display a loading screen when the page is not hydrated
// the text should be in the middle of the screen
// the text should be "Loading..." and a 3 dot animation

export default function NotHydrated() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="text-2xl font-bold text-slate-800">Loading...</div>
      <div className="text-sm text-slate-600">
        This may take a few seconds...
      </div>
      <div className="text-sm text-slate-600">Please wait...</div>
      <div className="text-sm text-slate-600">
        If this takes too long, please refresh the page.
      </div>
      <div className="text-sm text-slate-600">
        If you are seeing this, please contact the developer. You know him,
        right?
      </div>
      <div className="text-sm text-slate-600">Thank you for your patience.</div>
    </div>
  );
}
