import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

export default function FinancePage() {
    return (
        <PageContainer>
            <PageHeader title="Finance & Scolarité" />
            <EmptyState
                title="Module à venir"
                description="Le module de suivi de la comptabilité, des scolarités et de l'enregistrement des paiements est en cours de préparation."
            />
        </PageContainer>
    );
}
