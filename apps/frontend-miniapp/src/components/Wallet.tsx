import './Wallet.css';

interface WalletProps {
  kyatBalance: number;
  points: number;
}

export default function Wallet({ kyatBalance, points }: WalletProps) {
  return (
    <div className="wallet-card">
      <div className="wallet-item">
        <div className="label-row">
          <span className="label">လက်ကျန်ငွေ</span>
          <span className="exchange-rate">1$ = 5000 KYAT</span>
        </div>
        <span className="value">{Number(kyatBalance).toLocaleString()} KYAT</span>
      </div>
      <div className="wallet-item">
        <span className="label">အမှတ်</span>
        <span className="value">{Number(points).toLocaleString()}</span>
      </div>
    </div>
  );
}

