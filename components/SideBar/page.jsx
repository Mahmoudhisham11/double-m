'use client';
import styles from "./styles.module.css";
import Image from "next/image";
import Link from "next/link";
import logo from "../../public/images/logo.png"
import { IoHomeOutline } from "react-icons/io5";
import { IoIosPhonePortrait } from "react-icons/io";
import { TbMoneybag } from "react-icons/tb";
import { HiOutlineWallet } from "react-icons/hi2";
import { GoGear } from "react-icons/go";
import { BiLogOutCircle } from "react-icons/bi";
import { TbReportSearch } from "react-icons/tb";
import { TbReportMoney } from "react-icons/tb";
import { IoPersonOutline } from "react-icons/io5";
import { CiWallet } from "react-icons/ci";
import { IoIosCloseCircle } from "react-icons/io";
import { GoGraph } from "react-icons/go";

function SideBar({openSideBar, setOpenSideBar}) {
    const handleLogout = () => {
        if(typeof window !== 'undefined') {
            localStorage.clear()
            window.location.reload()
        }
    }
    return(
        <div className={openSideBar ? `${styles.sideBar} ${styles.active}` : `${styles.sideBar}`}>
            <div className={styles.title}>
                <div className={styles.imageContainer}>
                    <h2>Lacoste</h2>
                    <div className={styles.imageBox}>
                        <Image src={logo} fill style={{objectFit: 'cover'}} alt="logo"/>
                    </div>
                </div>
                <button className={styles.closeBtn} onClick={() => setOpenSideBar(false)}><IoIosCloseCircle/></button>
            </div>
            <div className={styles.actions}>
                <Link href={'/'} className={styles.actionLinks}>
                    <span><IoHomeOutline/></span>
                    <span>الصفحة الرئيسية</span>
                </Link>
                <Link href={'/products'} className={styles.actionLinks}>
                    <span><HiOutlineWallet/></span>
                    <span>المنتجات</span>
                </Link>
                <Link href={'/masrofat'} className={styles.actionLinks}>
                    <span><TbMoneybag/></span>
                    <span>المصاريف</span>
                </Link>
                <Link href={'/employees'} className={styles.actionLinks}>
                    <span><IoPersonOutline/></span>
                    <span>الموظفين</span>
                </Link>
                <Link href={'/debts'} className={styles.actionLinks}>
                    <span><TbReportMoney/></span>
                    <span>الديون</span>
                </Link>
                <Link href={'/reports'} className={styles.actionLinks}>
                    <span><TbReportSearch/></span>
                    <span>التقارير</span>
                </Link>
                <Link href={'/balance'} className={styles.actionLinks}>
                    <span><GoGraph /></span>
                    <span>الارصدة</span>
                </Link>
            </div>
            <div className={styles.logout}>
                <Link href={'/settings'} className={styles.actionLinks}>
                    <span><GoGear/></span>
                    <span>الاعدادات</span>
                </Link>
                <Link href={'/'} className={styles.actionLinks} onClick={handleLogout}>
                    <span><BiLogOutCircle/></span>
                    <span>تسجيل الخروج</span>
                </Link>
            </div>
        </div>
    )
}

export default SideBar;