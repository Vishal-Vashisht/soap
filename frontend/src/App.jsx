import "./App.css";

function App() {
  return (
    <div className="page">
      <header className="navbar">
        <div className="brand">☁ SOAP Portal</div>
        <span className="tag">Developer API</span>
      </header>

      <main>
        <section className="hero">
          <span className="status">● Service portal</span>
          <h1>Integrate with our SOAP API</h1>
          <p>
            Get the WSDL definition and connect your application
            to our SOAP web service.
          </p>

          <div className="actions">
            <a className="primary" href="/soap?download_wsdl=1">
              ↓ Download WSDL
            </a>
            <a className="secondary" href="/soap?wsdl">
              View WSDL →
            </a>
          </div>
        </section>

        <section className="operations">
          <h2>Available operations</h2>
          <p className="subtitle">
            Three operations are available through this service.
          </p>

          <div className="cards">
            <article className="card">
              <div className="symbol blue">+</div>
              <h3>Add</h3>
              <p>Adds two integers and returns their sum.</p>
              <code>add(int, int) → int</code>
            </article>

            <article className="card">
              <div className="symbol green">×</div>
              <h3>Multiply</h3>
              <p>Multiplies two integers and returns the result.</p>
              <code>multiply(int, int) → int</code>
            </article>

            <article className="card">
              <div className="symbol purple">♙</div>
              <h3>Get Employees</h3>
              <p>Returns employee records, including names and salaries.</p>
              <code>get_employees() → Employee[]</code>
            </article>
          </div>
        </section>
      </main>

      <footer>SOAP Portal · Powered by React and Spyne</footer>
    </div>
  );
}

export default App;