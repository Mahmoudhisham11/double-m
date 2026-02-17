'use client';
import styles from "./styles.module.css";
import Link from "next/link";
import { IoIosCloseCircle } from "react-icons/io";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import {
  FiHome,
  FiBox,
  FiArchive,
  FiDownload,
  FiCreditCard,
  FiUsers,
  FiFileText,
  FiCalendar,
  FiRotateCcw,
  FiClock,
  FiTrendingUp,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { PERMISSIONS } from "@/constants/config";

function SideBar({openSideBar, setOpenSideBar}) {
    const [currentUser, setCurrentUser] = useState(null);
    const { theme, toggleTheme } = useTheme();
    const isAdmin = currentUser ? PERMISSIONS.VIEW_PROFIT(currentUser) : false;

    useEffect(() => {
        if (typeof window !== "undefined") {
            setCurrentUser(localStorage.getItem("userName"));
        }
    }, []);

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            try {
                // حذف بيانات المستخدم والمحل فقط
                localStorage.removeItem("userName");
                localStorage.removeItem("shop");
            } catch (e) {
                console.error("Error clearing auth data from localStorage", e);
            }
            window.location.reload();
        }
    }
    return(
        <div className={openSideBar ? `${styles.sideBar} ${styles.active}` : `${styles.sideBar}`}>
            <div className={styles.title}>
                <div className={styles.imageContainer}>
                    <h2>Devoria</h2>
                </div>
                <button className={styles.closeBtn} onClick={() => setOpenSideBar(false)}><IoIosCloseCircle/></button>
            </div>
            <div className={styles.themeToggle}>
                <button onClick={toggleTheme} className={styles.themeBtn} title={theme === "light" ? "التبديل للوضع الداكن" : "التبديل للوضع الفاتح"}>
                    {theme === "light" ? <MdDarkMode /> : <MdLightMode />}
                    <span>{theme === "light" ? "الوضع الداكن" : "الوضع الفاتح"}</span>
                </button>
            </div>
            <div className={styles.actions}>
                <Link href={'/'} className={styles.actionLinks}>
                    <span><FiHome/></span>
                    <span>الصفحة الرئيسية</span>
                </Link>
                <Link href={'/products'} className={styles.actionLinks}>
                    <span><FiBox/></span>
                    <span>المنتجات</span>
                </Link>
                <Link href={'/offers'} className={styles.actionLinks}>
                    <span><FiBox/></span>
                    <span>العروض</span>
                </Link>
                {isAdmin && 
                  <Link href={'/stock'} className={styles.actionLinks}>
                    <span><FiArchive/></span>
                    <span>المخزن</span>
                </Link>
                }
                <Link href={'/wared'} className={styles.actionLinks}>
                    <span><FiDownload/></span>
                    <span>الوارد</span>
                </Link>
                <Link href={'/masrofat'} className={styles.actionLinks}>
                    <span><FiCreditCard/></span>
                    <span>المصاريف</span>
                </Link>
                <Link href={'/employees'} className={styles.actionLinks}>
                    <span><FiUsers/></span>
                    <span>الموظفين</span>
                </Link>
                <Link href={'/debts'} className={styles.actionLinks}>
                    <span><FiFileText/></span>
                    <span>فواتير البضاعة</span>
                </Link>
                <Link href={'/dailyReports'} className={styles.actionLinks}>
                    <span><FiCalendar/></span>
                    <span>جرد يومي</span>
                </Link>
                <Link href={'/reports'} className={styles.actionLinks}>
                    <span><FiRotateCcw/></span>
                    <span>المرتجعات</span>
                </Link>
                <Link href={'/closeDay'} className={styles.actionLinks}>
                    <span><FiClock/></span>
                    <span>تقفيلة اليوم</span>
                </Link>
                {isAdmin && 
                  <Link href={'/profit'} className={styles.actionLinks}>
                    <span><FiTrendingUp/></span>
                    <span>الارباح</span>
                </Link>  
                }
            </div>
            <div className={styles.logout}>
                {isAdmin && 
                  <Link href={'/settings'} className={styles.actionLinks}>
                    <span><FiSettings/></span>
                    <span>الاعدادات</span>
                </Link>  
                }
                <Link href={'/'} className={styles.actionLinks} onClick={handleLogout}>
                    <span><FiLogOut/></span>
                    <span>تسجيل الخروج</span>
                </Link>
            </div>
        </div>
    )
}

export default SideBar;