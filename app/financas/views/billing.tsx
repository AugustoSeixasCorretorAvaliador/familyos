import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { DuplicateAmountForm } from "@/app/financas/duplicate-amount-form";
import { archiveInstallmentPurchase, cancelFutureInstallments, closeInvoice, createInstallmentPurchase, createInvoice, payInvoice, reverseInvoicePayment, updateInstallmentPurchase } from "@/app/financas/actions";
import { currentCompetence } from "@/lib/finance/services";
import { invoiceDisplayAmount, invoiceEntriesForCard, invoiceExpectedAmount } from "@/lib/finance/summary";
import type { FinanceWorkspace } from "@/lib/finance/types";
import { currency, danger, Empty, field, FieldLabel, formatDate, FormPanel, monthLabel, Options, panel, primary, SaveButton } from "@/app/financas/views/shared";

function InstallmentFields({ workspace, purchase, categoryId }: { workspace: FinanceWorkspace; purchase?: FinanceWorkspace["installments"][number]; categoryId?: string | null }) {
  return <>
    <label className="text-xs text-slate-600">Descrição<input name="description" required defaultValue={purchase?.description} className={`mt-1 block w-full ${field}`}/></label>
    <label className="text-xs text-slate-600">Valor total da compra<input name="total_amount" required inputMode="decimal" defaultValue={purchase?.total_amount} placeholder="Ex.: 974,16" className={`mt-1 block w-full ${field}`}/></label>
    <label className="text-xs text-slate-600">Quantidade de parcelas<input name="installment_count" required type="number" min="1" max="360" defaultValue={purchase?.installment_count} className={`mt-1 block w-full ${field}`}/></label>
    <label className="text-xs text-slate-600">Primeira competência<input name="first_competence" required type="month" defaultValue={purchase?.first_competence.slice(0, 7)} className={`mt-1 block w-full ${field}`}/></label>
    <label className="text-xs text-slate-600">Data da compra<input name="purchase_date" type="date" defaultValue={purchase?.purchase_date ?? ""} className={`mt-1 block w-full ${field}`}/></label>
    <label className="text-xs text-slate-600">Cartão<select name="card_id" defaultValue={purchase?.card_id ?? ""} className={`mt-1 block w-full ${field}`}><Options placeholder="Cartão" rows={workspace.cards.map((row) => ({ id: row.id, label: row.name }))}/></select></label>
    <label className="text-xs text-slate-600">Tipo/classificação da compra<select name="category_id" defaultValue={categoryId ?? purchase?.category_id ?? ""} className={`mt-1 block w-full ${field}`}><Options placeholder="Tipo da compra" rows={workspace.categories.filter((row) => !row.name.toLocaleLowerCase("pt-BR").startsWith("cartão de crédito")).map((row) => ({ id: row.id, label: row.name }))}/></select></label>
  </>;
}

export function InstallmentsView({ workspace, canEdit }: { workspace: FinanceWorkspace; canEdit: boolean }) {
  return <div className="space-y-5">
    {canEdit && <FormPanel title="Nova compra parcelada"><DuplicateAmountForm action={createInstallmentPurchase} amountField="total_amount" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><InstallmentFields workspace={workspace}/><p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">Informe o valor total da compra; o sistema divide esse total pela quantidade de parcelas. Ao selecionar um cartão, a Visão Geral agrupa automaticamente as parcelas nesse cartão.</p><div className="sm:col-span-2 lg:col-span-3"><SaveButton label="Gerar parcelas"/></div></DuplicateAmountForm></FormPanel>}
    <section className={panel}><h2 className="font-semibold">Parcelamentos</h2>{workspace.installments.length ? <div className="mt-4 space-y-3">{workspace.installments.map((purchase) => {
      const installments = workspace.entries.filter((entry) => entry.installment_purchase_id === purchase.id).sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));
      return <article key={purchase.id} className="rounded-xl border p-4"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-semibold">{purchase.description}</p><p className="text-sm text-slate-500">{purchase.installment_count} parcelas · {purchase.status}</p></div><p className="font-semibold">{currency.format(purchase.total_amount)}</p></div>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-sky-700">Visualizar parcelas ({installments.length})</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{installments.map((entry) => <div key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{entry.installment_number}/{entry.installment_count} · {monthLabel(entry.competence)}</p><p>{currency.format(entry.expected_amount)} · {entry.status}</p></div>)}</div></details>
        {canEdit && <div className="mt-4 space-y-3">{purchase.status === "active" && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-sky-700">Editar parcelamento</summary><form action={updateInstallmentPurchase} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><input type="hidden" name="id" value={purchase.id}/><InstallmentFields workspace={workspace} purchase={purchase} categoryId={installments.find((entry) => entry.classification_category_id)?.classification_category_id}/><div className="sm:col-span-2 lg:col-span-3"><SaveButton/></div></form></details>}
          <div className="flex flex-wrap items-end gap-2">{purchase.status === "active" && <form action={cancelFutureInstallments} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={purchase.id}/><label className="text-xs text-slate-600">Cancelar a partir de<input name="from_competence" type="month" required defaultValue={currentCompetence().slice(0, 7)} className={`mt-1 block ${field}`}/></label><ConfirmSubmitButton label="Cancelar parcelas futuras" confirmMessage="Somente parcelas futuras ainda não realizadas serão canceladas. Continuar?" className={danger}/></form>}
            <form action={archiveInstallmentPurchase}><input type="hidden" name="id" value={purchase.id}/><ConfirmSubmitButton label="Excluir (arquivar)" confirmMessage="O parcelamento e todas as parcelas serão arquivados, sem apagar o histórico. Deseja continuar?" className={danger}/></form>
          </div>
        </div>}
      </article>;
    })}</div> : <Empty>Nenhum parcelamento cadastrado.</Empty>}</section>
  </div>;
}

export function InvoicesView({ workspace, canEdit }: { workspace: FinanceWorkspace; canEdit: boolean }) {
  const statusLabels: Record<string, string> = { open: "ABERTA", closed: "FECHADA", paid: "PAGO", cancelled: "CANCELADA" };
  const today = new Date().toISOString().slice(0, 10);
  return <div className="space-y-5">
    {canEdit && <FormPanel title="Montar fatura"><form action={createInvoice} className="grid gap-3 sm:grid-cols-3">
      <FieldLabel label="Cartão" help="Reúne os lançamentos deste cartão e desta competência em uma única fatura."><select name="card_id" required className={`block w-full ${field}`}><Options placeholder="Selecione o cartão" rows={workspace.cards.map((row) => ({ id: row.id, label: row.name }))}/></select></FieldLabel>
      <FieldLabel label="Competência" help="Mês ao qual pertencem as compras e despesas que serão vinculadas à fatura."><input name="competence" type="month" required defaultValue={currentCompetence().slice(0, 7)} className={`block w-full ${field}`}/></FieldLabel>
      <FieldLabel label="Data de vencimento" help="Data limite para pagamento; não altera a competência dos lançamentos."><input name="due_date" type="date" required className={`block w-full ${field}`}/></FieldLabel>
      <p className="text-xs text-slate-500 sm:col-span-3">Montar novamente a mesma competência atualiza a fatura existente e vincula lançamentos ainda não associados.</p><div className="sm:col-span-3"><SaveButton label="Montar fatura"/></div>
    </form></FormPanel>}
    <section className={panel}><h2 className="font-semibold">Faturas</h2>{workspace.invoices.length ? <div className="mt-4 space-y-3">{workspace.invoices.map((invoice) => {
      const card = workspace.cards.find((item) => item.id === invoice.card_id);
      const entries = invoiceEntriesForCard(workspace.entries, invoice.card_id, invoice.competence);
      const calculatedExpected = invoiceExpectedAmount(entries, invoice.expected_amount);
      const amount = invoiceDisplayAmount(invoice, calculatedExpected);
      const isPaid = invoice.status === "paid";
      return <article key={invoice.id} className={`rounded-xl border p-4 ${isPaid ? "border-emerald-300 bg-emerald-50/50" : ""}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{card?.name ?? "Cartão"} · {monthLabel(invoice.competence)}</p><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span>Vence {formatDate(invoice.due_date)}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${isPaid ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{statusLabels[invoice.status] ?? invoice.status.toLocaleUpperCase("pt-BR")}</span></p></div><p className={`text-xl font-semibold ${isPaid ? "text-emerald-700" : ""}`}>{currency.format(amount)}</p></div>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-sky-700">Visualizar lançamentos ({entries.length})</summary><div className="mt-2 space-y-2">{entries.map((entry) => <div key={entry.id} className="flex justify-between rounded-lg bg-white p-3 text-sm"><span>{entry.description}</span><span>{currency.format(entry.expected_amount)}</span></div>)}</div></details>
        {canEdit && <div className="mt-4 flex flex-wrap items-end gap-3">{invoice.status === "open" && <form action={closeInvoice} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={invoice.id}/><FieldLabel label="Valor de fechamento" help="Total efetivamente fechado da fatura; por padrão usa a soma atual dos lançamentos do cartão."><input name="closed_amount" defaultValue={calculatedExpected} inputMode="decimal" className={`${field} block w-32`}/></FieldLabel><input type="hidden" name="closing_date" value={today}/><ConfirmSubmitButton label="Fechar fatura" confirmMessage="Confirma o fechamento desta fatura?" className={primary}/></form>}
          {!["paid", "cancelled"].includes(invoice.status) && <form action={payInvoice} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={invoice.id}/><FieldLabel label="Valor pago" help="Valor que sairá da conta. Por padrão usa o total fechado ou previsto da fatura."><input name="paid_amount" defaultValue={amount} inputMode="decimal" className={`${field} block w-32`}/></FieldLabel><FieldLabel label="Data do pagamento" help="Data efetiva da saída de caixa e da baixa simultânea dos itens do cartão."><input name="payment_date" required type="date" defaultValue={today} className={`block ${field}`}/></FieldLabel><FieldLabel label="Conta de pagamento" help="Conta debitada. O cartão configurado fornece a conta padrão, que pode ser alterada aqui."><select name="payment_account_id" required defaultValue={invoice.payment_account_id ?? card?.payment_account_id ?? ""} className={`block ${field}`}><Options placeholder="Selecione a conta" rows={workspace.accounts.map((row) => ({ id: row.id, label: row.institution }))}/></select></FieldLabel><SaveButton label="Pagar"/></form>}
          {isPaid && <form action={reverseInvoicePayment} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={invoice.id}/><FieldLabel label="Data do estorno" help="Registra a entrada de estorno, reabre a fatura e desliga a baixa dos itens no painel."><input name="reversal_date" required type="date" defaultValue={today} className={`block ${field}`}/></FieldLabel><ConfirmSubmitButton label="Estornar pagamento" confirmMessage="O estorno criará a contrapartida no caixa, reabrirá a fatura e marcará os itens como não pagos. Continuar?" className={danger}/></form>}
        </div>}
      </article>;
    })}</div> : <Empty>Nenhuma fatura montada.</Empty>}</section>
  </div>;
}
