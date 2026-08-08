import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

export default function StudentsPage() {
    return (
        <PageContainer>
            <PageHeader title="Gestion des Élèves" />
            <EmptyState
                title="Module à venir"
                description="Le module de gestion des élèves (recherche, inscriptions et fiches individuelles) est en cours de préparation."
            />
        </PageContainer>
    );
}
