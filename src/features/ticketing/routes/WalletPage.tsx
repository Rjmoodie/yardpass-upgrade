import { WalletDashboard } from "@/components/wallet/WalletDashboard";
import { Helmet } from "react-helmet-async";

const WalletPage = () => {
  return (
    <>
      <Helmet>
        <title>Wallet - YardPass</title>
        <meta name="description" content="Manage your YardPass ad credits and view transaction history" />
      </Helmet>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Wallet</h1>
          <p className="text-muted-foreground">
            Manage your ad credits for YardPass campaigns
          </p>
        </div>

        <WalletDashboard />
      </div>
    </>
  );
};

export default WalletPage;