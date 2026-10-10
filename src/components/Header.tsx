export default function Header({ title, who, wide }: { title: string; who?: React.ReactNode; wide?: boolean }) {
  return (
    <header className="hdr">
      <div className={"wrap" + (wide ? " wide" : "")}>
        <div className="avatar" aria-hidden="true">Y</div>
        <div className="titles">
          <div className="kicker">Yoda · Mashura</div>
          <h1>{title}</h1>
        </div>
        {who ? <div className="who">{who}</div> : null}
        {/* Mashura logomark, white on chrome (Mashura Internal UI kit). */}
        <svg className="hdr-mark" viewBox="0 0 362 320" role="img" aria-label="Mashura">
          <path
            fill="currentColor"
            d="M261.89,119.63c-48.12,0-76.43,21.79-76.43,75.04v26.38h-8.93v-26.38c0-53.25-28.31-75.04-76.42-75.04,12.02-8.99,40.4-20.68,80.89-20.68s68.86,11.69,80.89,20.68Z"
          />
        </svg>
      </div>
    </header>
  );
}
