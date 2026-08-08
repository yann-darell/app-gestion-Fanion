import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

export default function SettingsPage() {
    return (
        <PageContainer>
            <PageHeader title="Paramètres" />
            <EmptyState
                title="Module à venir"
                description="Le module de configuration de l'année scolaire active, de sauvegarde et de restauration de la base de données est en cours de préparation."
            />
        </PageContainer>
    );
}
