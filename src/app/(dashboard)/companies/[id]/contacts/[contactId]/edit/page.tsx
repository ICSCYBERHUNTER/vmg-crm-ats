import Link from 'next/link'
import { getContactById } from '@/lib/supabase/contacts'
import { ContactForm } from '@/components/contacts/ContactForm'
import { Button } from '@/components/ui/button'

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>
}) {
  const { id: companyId, contactId } = await params
  const contact = await getContactById(contactId).catch(() => null)

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Contact Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This contact may have been deleted or the link is incorrect.
        </p>
        <Link href={`/companies/${companyId}`} className="mt-6">
          <Button variant="outline">Back to Company</Button>
        </Link>
      </div>
    )
  }

  return <ContactForm companyId={companyId} contact={contact} />
}
