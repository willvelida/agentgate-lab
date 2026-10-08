import './App.css'

function App() {
  return (
    <main className="shell">
      <header className="header">
        <div>
          <p className="eyebrow">AgentGate Lab</p>
          <h1>Secure agent operations, one step at a time.</h1>
        </div>
        <span className="status" role="status">
          Foundation preview
        </span>
      </header>

      <section className="intro" aria-labelledby="intro-heading">
        <p className="eyebrow">Starter shell</p>
        <h2 id="intro-heading">The portal is ready for the ticket workflow.</h2>
        <p>
          Authentication, ACS enforcement, and ticket operations are not
          implemented yet. This same-origin React shell is the foundation for
          those later milestones.
        </p>
      </section>

      <section className="boundary-grid" aria-label="Repository boundaries">
        <article>
          <h2>Portal</h2>
          <p>Human-facing BFF and published frontend assets.</p>
        </article>
        <article>
          <h2>Gateway</h2>
          <p>Private authorization and tool execution boundary.</p>
        </article>
        <article>
          <h2>Agent Worker</h2>
          <p>Separate worker host for future agent jobs.</p>
        </article>
      </section>
    </main>
  )
}

export default App
