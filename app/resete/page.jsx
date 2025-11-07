'use client';
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import Image from "next/image";
import resetImage from "../../public/images/logo.png";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react"; // ✅ استيراد مكتبة QRCode

function Resete() {
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);

  // ✅ نجيب التاريخ الحالي
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lastInvoice = localStorage.getItem("lastInvoice");
    if (lastInvoice) setInvoice(JSON.parse(lastInvoice));

    // ✅ صياغة التاريخ
    const today = new Date();
    const formattedDate = today.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setCurrentDate(formattedDate);
  }, []);

  const handlePrint = () => {
    if (!invoice) { 
      alert("لا توجد فاتورة للطباعة."); 
      return; 
    }
    window.print();
  };

  if (!invoice) return <div className={styles.resete}><p>لا توجد فاتورة لعرضها.</p></div>;

  return (
    <div className={styles.resete}>
      <div className={styles.title}>
        <button onClick={() => router.push('/')} className={styles.btnBack}>رجوع</button>
        <h2>DOUBLE M</h2>
        {/* <div className={styles.imageContainer}>
          <Image src={resetImage} fill style={{ objectFit: 'cover' }} alt="logo" />
        </div> */}
      </div>

      {/* عرض الفاتورة على الشاشة */}
      <div className={styles.invoice}>
        <h3 style={{ textAlign: 'center' }}>فاتورة مبيعات</h3>
        {/* ✅ التاريخ */}
        <p><strong>التاريخ:</strong> {currentDate}</p>
        <p><strong>العميل:</strong> {invoice.clientName}</p>
        <p><strong>الهاتف:</strong> {invoice.phone}</p>

        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر</th>
            </tr>
          </thead>
          <tbody>
            {invoice.cart.map(item => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>{item.total} جنية</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>الإجمالي: {invoice.total} جنية</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={styles.text}>
        <p>عدد الاصناف:<span>{invoice.length}</span></p>
        <p>العنوان: 1 جول جمال الف مسكن</p>
        <p style={{ textAlign: 'center', marginTop: '5px'}}>شكراً لتعاملكم معنا!</p>
      </div>

      <div className={styles.btn}>
        <button onClick={handlePrint}>طباعة الفاتورة</button>
      </div>

      <div className={styles.footer}>
        <strong>تم التوجيه بواسطة: Devoria</strong>
      </div>
    </div>
  );
}

export default Resete;
