import { ContactForm } from '@/components/contacts/ContactForm'

export default async function NewContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyId } = await params

  return <ContactForm companyId={companyId} />
}
