import { Outlet, Link, useLocation } from 'react-router-dom';

export function Layout() {
  const location = useLocation();

  return (
    <div className="layout">
      <header className="header">
        <nav className="nav">
          <Link to="/plans" className="nav-brand">
            Planner
          </Link>
          <div className="nav-links">
            <Link
              to="/plans"
              className={location.pathname === '/plans' ? 'nav-link active' : 'nav-link'}
            >
              Plans
            </Link>
            <Link
              to="/plans/new"
              className={location.pathname === '/plans/new' ? 'nav-link active' : 'nav-link'}
            >
              New Plan
            </Link>
          </div>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
