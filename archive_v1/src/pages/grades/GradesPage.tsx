import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

export default function GradesPage() {
    return (
        <PageContainer>
            <PageHeader title="Bulletins & Notes" />
            <EmptyState
                title="Module à venir"
                description="Le module de saisie des notes et de génération des bulletins scolaires est en cours de préparation."
            />
        </PageContainer>
    );
}
