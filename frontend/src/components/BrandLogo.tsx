import logoUrl from "../assets/logo.png";

type BrandLogoProps = {
  onClick?: () => void;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
};

const BrandLogo = ({
  onClick,
  width = 96,
  height = 96,
  className = "landing__logo",
  label = "NextPlay",
}: BrandLogoProps) => {
  return (
    <div className={className} onClick={onClick}>
      <img src={logoUrl} alt="NextPlay Logo" width={width} height={height} />
      <span>{label}</span>
    </div>
  );
};

export default BrandLogo;
