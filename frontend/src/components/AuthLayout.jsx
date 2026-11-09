import { Logo } from './Icon.jsx';

export default function AuthLayout({ title, sub, children, footer }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="shapes" aria-hidden="true">
          <i className="sh sh-red" />
          <i className="sh sh-black" />
          <i className="sh sh-white" />
          <i className="sh sh-dot" />
        </div>
        <div className="auth-brand">
          <Logo size={34} />
          <span>Market Day</span>
        </div>
        <h1>{title}</h1>
        <p className="sub">{sub}</p>
        {children}
        <div className="auth-foot">{footer}</div>
      </div>
    </div>
  );
}
