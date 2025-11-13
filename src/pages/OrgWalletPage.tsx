import { useParams } from "react-router-dom";
import { OrgWalletDashboard } from "@/components/wallet/OrgWalletDashboard";
import { Helmet } from "react-helmet-async";

const OrgWalletPage = () => {
  const { orgId } = useParams<{ orgId: string }>();

  if (!orgId) {
    return <div>Organization not found</div>;
  }

  return (
    <>
      <Helmet>
        <title>Organization Wallet - Liventix</title>
        <meta name="description" content="Manage your organization's ad credits" />
      </Helmet>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Organization Wallet</h1>
          <p className="text-muted-foreground">
            Manage ad credits for your organization's campaigns
          </p>
        </div>

        <OrgWalletDashboard orgId={orgId} />
      </div>
    </>
  );
};

export default OrgWalletPage;