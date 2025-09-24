import { NavLink } from "react-router-dom";

import { tokens } from "../styles/tokens";

const links = [
  { to: "/?entity=ships", label: "Ships" },
  { to: "/?entity=blueprints", label: "Blueprints" },
];

export function Sidebar(): JSX.Element {
  return (
    <nav aria-label="Primary" style={styles.nav}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            ...styles.link,
            backgroundColor: isActive ? tokens.colors.surface : "transparent",
            color: isActive ? tokens.colors.accentCyan : tokens.colors.textPrimary,
          })}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    flexDirection: "column" as const,
    gap: tokens.spacing.md,
    width: "14rem",
  },
  link: {
    textDecoration: "none",
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radii.md,
    fontWeight: 600,
  },
};

export default Sidebar;
