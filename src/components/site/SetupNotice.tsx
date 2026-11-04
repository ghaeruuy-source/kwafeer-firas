export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-2xl text-gold">الموقع يحتاج إعداد</p>
      <p className="text-mute">
        ما لكينا الصالون بقاعدة البيانات. تأكد إن <code className="num text-bone">NEXT_PUBLIC_SHOP_SLUG</code> يطابق الصالون اللي سويته
        بأمر <code className="num text-bone">setup_shop</code>. التفاصيل بملف README.
      </p>
    </main>
  );
}
