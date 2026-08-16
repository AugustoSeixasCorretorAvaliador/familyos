import Link from "next/link";
import { redirect } from "next/navigation";
import { AssetDocumentUploadForm } from "@/app/components/asset-document-upload-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { FieldLabel } from "@/app/components/field-label";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import { archiveVehicle, createVehicle, updateVehicle } from "@/app/automoveis/actions";
import { deleteAssetDocument } from "@/app/patrimonio-documentos/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { getDocumentProcessingLabel } from "@/lib/document-intake/status";
import { canAdminFamily, canEditFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: { success?: string; error?: string; request_id?: string; count?: string };
};

type Vehicle = {
  id: string;
  owner_person_id: string | null;
  title: string;
  make: string;
  model: string;
  version: string | null;
  manufacture_year: number | null;
  model_year: number | null;
  plate: string | null;
  renavam: string | null;
  vin: string | null;
  color: string | null;
  fuel_type: string | null;
  acquisition_date: string | null;
  acquisition_value: number | null;
  estimated_value: number | null;
  status: string;
  notes: string | null;
};

type Person = { id: string; first_name: string; last_name: string };
type VehicleDocument = {
  id: string;
  vehicle_id: string;
  title: string;
  document_type: string;
  processing_status: string;
  metadata: Record<string, unknown> | null;
};

const DOCUMENT_TYPES = ["CRLV", "CRV / ATPV-e", "Nota Fiscal", "Contrato de Financiamento", "Vistoria", "Manual", "Outro"];
const STATUS = [
  ["active", "Ativo"],
  ["financed", "Financiado"],
  ["sold", "Vendido"],
  ["archived", "Arquivado"],
] as const;
const fieldClass = "block w-full rounded-xl border border-slate-300 px-3 py-2";

function VehicleFields({ vehicle, people }: { vehicle?: Vehicle; people: Person[] }) {
  return <>
    <FieldLabel label="Título de identificação" help="Nome amigável usado para localizar o automóvel nas listas, documentos e seguros."><input name="title" required defaultValue={vehicle?.title ?? ""} placeholder="Ex.: Carro da família" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Proprietário ou responsável" help="Pessoa relacionada ao veículo para organização patrimonial, documentos e seguros."><select name="owner_person_id" defaultValue={vehicle?.owner_person_id ?? ""} className={fieldClass}><option value="">Não informado</option>{people.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}</select></FieldLabel>
    <FieldLabel label="Marca" help="Fabricante do veículo, usado na identificação e nos resumos patrimoniais."><input name="make" required defaultValue={vehicle?.make ?? ""} placeholder="Ex.: Toyota" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Modelo" help="Modelo comercial exibido junto da marca nas listas e vínculos."><input name="model" required defaultValue={vehicle?.model ?? ""} placeholder="Ex.: Corolla" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Versão" help="Complementa o modelo com motorização ou acabamento para identificação precisa."><input name="version" defaultValue={vehicle?.version ?? ""} placeholder="Versão opcional" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Placa" help="Identificador de circulação, normalizado em maiúsculas e usado para localizar o veículo."><input name="plate" defaultValue={vehicle?.plate ?? ""} placeholder="ABC1D23" className={`${fieldClass} uppercase`} /></FieldLabel>
    <FieldLabel label="Ano de fabricação" help="Ano em que o veículo foi produzido; auxilia histórico, documentos e avaliação."><input name="manufacture_year" type="number" min="1886" max="2200" defaultValue={vehicle?.manufacture_year ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Ano do modelo" help="Ano comercial do modelo, exibido como referência principal quando informado."><input name="model_year" type="number" min="1886" max="2200" defaultValue={vehicle?.model_year ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="RENAVAM" help="Número nacional do veículo para conferência e vínculo com documentos oficiais."><input name="renavam" defaultValue={vehicle?.renavam ?? ""} placeholder="RENAVAM" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Chassi" help="Identificador único do veículo usado em documentos, seguros e auditoria patrimonial."><input name="vin" defaultValue={vehicle?.vin ?? ""} placeholder="Número do chassi" className={`${fieldClass} uppercase`} /></FieldLabel>
    <FieldLabel label="Cor" help="Característica descritiva usada na identificação visual do automóvel."><input name="color" defaultValue={vehicle?.color ?? ""} placeholder="Cor" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Combustível" help="Tipo de energia ou combustível do veículo para referência patrimonial."><input name="fuel_type" defaultValue={vehicle?.fuel_type ?? ""} placeholder="Ex.: Flex, gasolina, elétrico" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Data de aquisição" help="Marco da entrada do veículo no patrimônio familiar."><input name="acquisition_date" type="date" defaultValue={vehicle?.acquisition_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Status" help="Indica se o veículo está ativo, financiado, vendido ou arquivado e controla sua classificação na lista."><select name="status" defaultValue={vehicle?.status ?? "active"} className={fieldClass}>{STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FieldLabel>
    <FieldLabel label="Valor de aquisição" help="Preço pago na compra, preservado como referência histórica patrimonial."><input name="acquisition_value" defaultValue={vehicle?.acquisition_value ?? ""} inputMode="decimal" placeholder="Ex.: 120.000,00" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Valor estimado atual" help="Valor corrente usado no total estimado da frota e visão patrimonial."><input name="estimated_value" defaultValue={vehicle?.estimated_value ?? ""} inputMode="decimal" placeholder="Ex.: 105.000,00" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Observações" help="Informações complementares para consulta; não alteram os cálculos patrimoniais." className="md:col-span-2"><textarea name="notes" defaultValue={vehicle?.notes ?? ""} rows={2} placeholder="Observações opcionais" className={fieldClass} /></FieldLabel>
  </>;
}

function currency(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function successMessage(success?: string, count?: string) {
  if (success === "created") return "Automóvel cadastrado com sucesso.";
  if (success === "updated") return "Automóvel atualizado com sucesso.";
  if (success === "archived") return "Automóvel arquivado com sucesso.";
  if (success === "document_deleted") return "Documento excluído com sucesso.";
  if (success === "document_uploaded") return "Documento revisado e vinculado ao automóvel.";
  if (success === "documents_archived") return `${count ?? "1"} arquivo(s) arquivado(s) sem OCR.`;
  return null;
}

export default async function AutomoveisPage({ searchParams }: PageProps) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  const supabase = createClient();
  const [{ data: vehiclesData, error: vehiclesError }, { data: peopleData }, { data: documentsData }] = await Promise.all([
    supabase.from("vehicles").select("id,owner_person_id,title,make,model,version,manufacture_year,model_year,plate,renavam,vin,color,fuel_type,acquisition_date,acquisition_value,estimated_value,status,notes").eq("family_id", family.id).is("deleted_at", null).order("title"),
    supabase.from("people").select("id,first_name,last_name").eq("family_id", family.id).is("deleted_at", null).order("first_name"),
    supabase.from("documents").select("id,vehicle_id,title,document_type,processing_status,metadata").eq("family_id", family.id).not("vehicle_id", "is", null).order("created_at", { ascending: false }),
  ]);
  const vehicles = (vehiclesData ?? []) as Vehicle[];
  const people = (peopleData ?? []) as Person[];
  const documents = (documentsData ?? []) as VehicleDocument[];
  const peopleById = new Map(people.map((person) => [person.id, `${person.first_name} ${person.last_name}`]));
  const total = vehicles.reduce((sum, vehicle) => sum + (vehicle.estimated_value ?? 0), 0);
  const message = successMessage(searchParams.success, searchParams.count);
  const canEdit = canEditFamily(context);
  const canAdmin = canAdminFamily(context);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <MainNav current="automoveis" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-2xl font-semibold text-slate-900">Automóveis</h1><p className="mt-1 text-slate-600">Veículos e documentos da família {family.name}.</p></div>
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-right"><p className="text-xs text-blue-700">Valor estimado da frota</p><p className="font-semibold text-blue-950">{currency(total)}</p></div>
          </div>
        </header>

        {(message || searchParams.error) && <section role={searchParams.error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${searchParams.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{searchParams.error ? getActionErrorMessage(searchParams.error, searchParams.request_id) : message}</section>}

        {canEdit && <ExpandableCreateForm id="create-vehicle" title="Cadastrar automóvel" buttonLabel="NOVO AUTOMÓVEL" submitAction={createVehicle} outcome={searchParams.error ? "error" : searchParams.success === "created" ? "success" : null} formClassName="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VehicleFields people={people} />
          <div className="md:col-span-2"><SubmitButton label="Salvar automóvel" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" /></div>
        </ExpandableCreateForm>}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Automóveis cadastrados</h2><span className="text-sm text-slate-500">{vehicles.length}</span></div>
          {vehiclesError ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">Não foi possível carregar os automóveis. A migration do módulo pode estar pendente.</p> : vehicles.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum automóvel cadastrado.</p> : <div className="mt-4 space-y-3">{vehicles.map((vehicle) => {
            const vehicleDocuments = documents.filter((document) => document.vehicle_id === vehicle.id);
            return <details key={vehicle.id} className="rounded-xl border border-slate-200 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><div><p className="font-medium text-slate-900">{vehicle.title}</p><p className="text-sm text-slate-600">{vehicle.make} {vehicle.model} {vehicle.version ?? ""} · {vehicle.plate ?? "Sem placa"}</p></div><div className="text-right"><p className="text-sm font-medium text-slate-900">{currency(vehicle.estimated_value)}</p><p className="text-xs text-slate-500">{vehicle.model_year ?? vehicle.manufacture_year ?? "Ano não informado"}</p></div></summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-700">Responsável: {vehicle.owner_person_id ? peopleById.get(vehicle.owner_person_id) ?? "Não encontrado" : "Não informado"}</p>
                {canEdit && <form action={updateVehicle} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input type="hidden" name="vehicle_id" value={vehicle.id} />
                  <VehicleFields vehicle={vehicle} people={people} />
                  <div className="md:col-span-2"><SubmitButton label="Salvar alterações" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white" /></div>
                </form>}
                <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><h3 className="font-medium text-slate-900">Documentos do automóvel ({vehicleDocuments.length})</h3>{canEdit && <AssetDocumentUploadForm familyId={family.id} entityId={vehicle.id} entityType="vehicle" documentTypes={DOCUMENT_TYPES} />}
                  {vehicleDocuments.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum documento vinculado.</p> : <div className="mt-4 space-y-2">{vehicleDocuments.map((document) => <div key={document.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-900">{document.title}</p><p className="text-xs text-slate-500">{document.document_type} · {getDocumentProcessingLabel(document.processing_status, document.metadata)}</p></div><div className="flex flex-wrap gap-2"><Link href={`/documentos/${document.id}/download`} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700">Baixar</Link><Link href={`/documentos/${document.id}/revisar`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Revisar</Link>{canAdmin && <form action={deleteAssetDocument}><input type="hidden" name="entity_type" value="vehicle" /><input type="hidden" name="entity_id" value={vehicle.id} /><input type="hidden" name="document_id" value={document.id} /><ConfirmSubmitButton label="Excluir" confirmMessage="Excluir este documento e seu arquivo privado?" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700" /></form>}</div></div>)}</div>}
                </section>
                {canAdmin && <form action={archiveVehicle}><input type="hidden" name="vehicle_id" value={vehicle.id} /><ConfirmSubmitButton label="Arquivar automóvel" confirmMessage="Arquivar este automóvel? Os documentos continuarão preservados." className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700" /></form>}
              </div>
            </details>;
          })}</div>}
        </section>
      </div>
    </main>
  );
}
