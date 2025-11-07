'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useState, useEffect } from "react";
import { MdPersonAddAlt1 } from "react-icons/md";
import { FaRegTrashAlt } from "react-icons/fa";
import { TbReportSearch } from "react-icons/tb";
import {
    addDoc,
    collection,
    onSnapshot,
    query,
    where,
    deleteDoc,
    getDoc,
    getDocs,
    doc
} from "firebase/firestore";
import { db } from "../firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";

function Employees() {
    const router = useRouter()
    const [auth, setAuth] = useState(false)
    const [loading, setLoading] = useState(true)
    const [active, setActive] = useState(false);
    const [newEmployee, setNewEmployee] = useState("");
    const [salary, setSalary] = useState(""); 
    const [employees, setEmployees] = useState([]);
    const shop = typeof window !== "undefined" ? localStorage.getItem('shop') : ""

    useEffect(() => {
    const checkLock = async() => {
      const userName = localStorage.getItem('userName')
      if(!userName) {
        router.push('/')
        return
      }
      const q = query(collection(db, 'users'), where('userName', '==', userName))
      const querySnapshot = await getDocs(q)
      if(!querySnapshot.empty) {
        const user = querySnapshot.docs[0].data()
        if(user.permissions?.employees === true) {
          alert('ليس ليدك الصلاحية للوصول الى هذه الصفحة❌')
          router.push('/')
          return
        }else {
          setAuth(true)
        }
      }else {
        router.push('/')
        return
      }
      setLoading(false)
    }
    checkLock()
  }, [])

    // ✅ جلب بيانات الموظفين من Collection employees
    useEffect(() => {
        if (!shop) return;
        const q = query(collection(db, 'employees'), where('shop', '==', shop));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEmployees(data);
        });

        return () => unsubscribe();
    }, [shop]);

    // ✅ اضافة موظف جديد
    const handleAddEmployee = async () => {
        if (!newEmployee.trim() || !salary.trim()) {
            alert("من فضلك أدخل اسم الموظف والراتب");
            return;
        }

        try {
            await addDoc(collection(db, "employees"), {
                name: newEmployee.trim(),
                salary: salary.trim(),
                createdAt: new Date(),
                userName: shop,
                shop,
            });
            alert("تمت إضافة الموظف بنجاح");
            setNewEmployee("");
            setSalary("");
            setActive(false);
        } catch (error) {
            console.error("خطأ أثناء إضافة الموظف:", error);
            alert("حدث خطأ أثناء إضافة الموظف");
        }
    };

    // ✅ حذف موظف
    const handleDeleteEmployee = async (id) => {
        const confirmDelete = window.confirm("هل أنت متأكد أنك تريد حذف هذا الموظف؟");
        if (!confirmDelete) return;

        try {
            await deleteDoc(doc(db, "employees", id));
            alert("تم حذف الموظف بنجاح");
        } catch (error) {
            console.error("خطأ أثناء حذف الموظف:", error);
            alert("حدث خطأ أثناء حذف الموظف");
        }
    };

    if (loading) return <p>🔄 جاري التحقق...</p>;
    if (!auth) return null;

    return (
        <div className={styles.employees}>
            <SideBar />
            <div className={styles.content}>
                <div className={styles.btns}>
                    <button onClick={() => setActive(false)}>كل الموظفين</button>
                    <button onClick={() => setActive(true)}>اضف موظف جديد</button>
                </div>

                {/* ✅ جدول الموظفين */}
                <div className={styles.employeesContent} style={{ display: active ? 'none' : 'flex' }}>
                    <div className={styles.tableContainer}>
                        <table>
                            <thead>
                                <tr>
                                    <th>اسم الموظف</th>
                                    <th>الراتب</th>
                                    <th>حذف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp) => (
                                    <tr key={emp.id}>
                                        <td>{emp.name}</td>
                                        <td>{emp.salary}</td>
                                        <td className={styles.actions}>
                                            <button 
                                                className={styles.deleteBtn} 
                                                onClick={() => handleDeleteEmployee(emp.id)}
                                            >
                                                <FaRegTrashAlt />
                                            </button>
                                            <Link className={styles.reportBtn} href={`/employeeReport/${emp.id}`}>
                                                <TbReportSearch />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ✅ إضافة موظف جديد */}
                <div className={styles.addEmployees} style={{ display: active ? 'flex' : 'none' }}>
                    <div className="inputContainer">
                        <label><MdPersonAddAlt1 /></label>
                        <input
                            type="text"
                            value={newEmployee}
                            onChange={(e) => setNewEmployee(e.target.value)}
                            placeholder="اسم الموظف"
                        />
                    </div>
                    <div className="inputContainer">
                        <label><MdPersonAddAlt1 /></label>
                        <input
                            type="number"
                            value={salary}
                            onChange={(e) => setSalary(e.target.value)}
                            placeholder="الراتب"
                        />
                    </div>
                    <button className={styles.addBtn} onClick={handleAddEmployee}>
                        اضف الموظف
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Employees;
