#!/usr/bin/env python3
"""
Backend API Testing for Sistema de Asistencia Escolar (SAE)
Tests all CRUD operations, authentication, QR generation, and reporting
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class SAEAPITester:
    def __init__(self, base_url="https://sysbqawd-ykdz-8001.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status
        })

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make API request with proper headers"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            return response
        except requests.exceptions.RequestException as e:
            return None

    def test_health_check(self):
        """Test health check endpoint"""
        print("\n🔍 Testing Health Check...")
        response = self.make_request('GET', '/health', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log_result("Health Check", True)
                    return True
                else:
                    self.log_result("Health Check", False, "Invalid response format")
            except:
                self.log_result("Health Check", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Health Check", False, f"Status code: {status}", 200, status)
        return False

    def test_login(self):
        """Test login with admin credentials"""
        print("\n🔍 Testing Login...")
        response = self.make_request('POST', '/auth/login', {
            'usuario': 'admin',
            'password': 'admin123'
        }, expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'token' in data and 'usuario' in data:
                    self.token = data['token']
                    self.log_result("Admin Login", True)
                    return True
                else:
                    self.log_result("Admin Login", False, "Missing token or usuario in response")
            except:
                self.log_result("Admin Login", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Admin Login", False, f"Status code: {status}", 200, status)
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n🔍 Testing Invalid Login...")
        response = self.make_request('POST', '/auth/login', {
            'usuario': 'invalid',
            'password': 'wrong'
        }, expected_status=401)
        
        if response and response.status_code == 401:
            self.log_result("Invalid Login Rejection", True)
            return True
        else:
            status = response.status_code if response else "No response"
            self.log_result("Invalid Login Rejection", False, f"Expected 401, got: {status}", 401, status)
        return False

    def test_auth_me(self):
        """Test get current admin info"""
        print("\n🔍 Testing Auth Me...")
        response = self.make_request('GET', '/auth/me', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'usuario' in data and data['usuario'] == 'admin':
                    self.log_result("Get Current Admin", True)
                    return True
                else:
                    self.log_result("Get Current Admin", False, "Invalid user data")
            except:
                self.log_result("Get Current Admin", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Get Current Admin", False, f"Status code: {status}", 200, status)
        return False

    def test_create_student(self):
        """Test creating a student"""
        print("\n🔍 Testing Create Student...")
        test_student = {
            "cedula": "12345678",
            "nombre": "Juan",
            "apellido1": "Pérez",
            "apellido2": "González",
            "especialidad": "Electromecánica",
            "grado": "10",
            "seccion": "A"
        }
        
        response = self.make_request('POST', '/estudiantes', test_student, expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data and data.get('cedula') == test_student['cedula']:
                    self.log_result("Create Student", True)
                    return test_student
                else:
                    self.log_result("Create Student", False, "Invalid response format")
            except:
                self.log_result("Create Student", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Create Student", False, f"Status code: {status}", 200, status)
        return None

    def test_get_students(self):
        """Test getting all students"""
        print("\n🔍 Testing Get Students...")
        response = self.make_request('GET', '/estudiantes', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get All Students", True, f"Found {len(data)} students")
                    return data
                else:
                    self.log_result("Get All Students", False, "Response is not a list")
            except:
                self.log_result("Get All Students", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Get All Students", False, f"Status code: {status}", 200, status)
        return []

    def test_get_student_by_cedula(self, cedula):
        """Test getting student by cedula"""
        print(f"\n🔍 Testing Get Student by Cedula: {cedula}...")
        response = self.make_request('GET', f'/estudiantes/{cedula}', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get('cedula') == cedula:
                    self.log_result("Get Student by Cedula", True)
                    return data
                else:
                    self.log_result("Get Student by Cedula", False, "Cedula mismatch")
            except:
                self.log_result("Get Student by Cedula", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Get Student by Cedula", False, f"Status code: {status}", 200, status)
        return None

    def test_update_student(self, cedula):
        """Test updating a student"""
        print(f"\n🔍 Testing Update Student: {cedula}...")
        update_data = {
            "nombre": "Juan Carlos",
            "seccion": "B"
        }
        
        response = self.make_request('PUT', f'/estudiantes/{cedula}', update_data, expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data:
                    self.log_result("Update Student", True)
                    return True
                else:
                    self.log_result("Update Student", False, "No success message")
            except:
                self.log_result("Update Student", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Update Student", False, f"Status code: {status}", 200, status)
        return False

    def test_generate_qr(self, cedula):
        """Test QR code generation"""
        print(f"\n🔍 Testing QR Generation for: {cedula}...")
        response = self.make_request('GET', f'/qr/{cedula}', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'qr_base64' in data and 'estudiante' in data:
                    self.log_result("QR Code Generation", True)
                    return data
                else:
                    self.log_result("QR Code Generation", False, "Missing qr_base64 or estudiante")
            except:
                self.log_result("QR Code Generation", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("QR Code Generation", False, f"Status code: {status}", 200, status)
        return None

    def test_create_attendance_record(self, cedula):
        """Test creating attendance record"""
        print(f"\n🔍 Testing Create Attendance Record for: {cedula}...")
        response = self.make_request('POST', '/registros', {'cedula': cedula}, expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data and 'registro' in data:
                    self.log_result("Create Attendance Record", True)
                    return data['registro']
                else:
                    self.log_result("Create Attendance Record", False, "Invalid response format")
            except:
                self.log_result("Create Attendance Record", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Create Attendance Record", False, f"Status code: {status}", 200, status)
        return None

    def test_get_attendance_records(self):
        """Test getting attendance records"""
        print("\n🔍 Testing Get Attendance Records...")
        response = self.make_request('GET', '/registros', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Attendance Records", True, f"Found {len(data)} records")
                    return data
                else:
                    self.log_result("Get Attendance Records", False, "Response is not a list")
            except:
                self.log_result("Get Attendance Records", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Get Attendance Records", False, f"Status code: {status}", 200, status)
        return []

    def test_get_today_records(self):
        """Test getting today's attendance records"""
        print("\n🔍 Testing Get Today's Records...")
        response = self.make_request('GET', '/registros/hoy', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'total' in data and 'registros' in data:
                    self.log_result("Get Today's Records", True, f"Total today: {data['total']}")
                    return data
                else:
                    self.log_result("Get Today's Records", False, "Invalid response format")
            except:
                self.log_result("Get Today's Records", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Get Today's Records", False, f"Status code: {status}", 200, status)
        return None

    def test_get_stats(self):
        """Test getting statistics"""
        print("\n🔍 Testing Get Statistics...")
        response = self.make_request('GET', '/stats', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                required_keys = ['total_estudiantes', 'registros_hoy', 'por_especialidad', 'por_grado']
                if all(key in data for key in required_keys):
                    self.log_result("Get Statistics", True)
                    return data
                else:
                    missing = [k for k in required_keys if k not in data]
                    self.log_result("Get Statistics", False, f"Missing keys: {missing}")
            except:
                self.log_result("Get Statistics", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Get Statistics", False, f"Status code: {status}", 200, status)
        return None

    def test_generate_pdf_report(self):
        """Test PDF report generation"""
        print("\n🔍 Testing PDF Report Generation...")
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        report_data = {
            "fecha_inicio": yesterday,
            "fecha_fin": today
        }
        
        response = self.make_request('POST', '/reportes/pdf', report_data, expected_status=200)
        
        if response and response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                self.log_result("PDF Report Generation", True, f"PDF size: {len(response.content)} bytes")
                return True
            else:
                self.log_result("PDF Report Generation", False, f"Wrong content type: {content_type}")
        else:
            status = response.status_code if response else "No response"
            self.log_result("PDF Report Generation", False, f"Status code: {status}", 200, status)
        return False

    def test_register_admin(self):
        """Test registering new admin"""
        print("\n🔍 Testing Register New Admin...")
        new_admin = {
            "usuario": f"testadmin_{int(datetime.now().timestamp())}",
            "password": "testpass123",
            "nombre": "Test Administrator"
        }
        
        response = self.make_request('POST', '/auth/register', new_admin, expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data:
                    self.log_result("Register New Admin", True)
                    return True
                else:
                    self.log_result("Register New Admin", False, "No success message")
            except:
                self.log_result("Register New Admin", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Register New Admin", False, f"Status code: {status}", 200, status)
        return False

    def test_delete_student(self, cedula):
        """Test deleting a student"""
        print(f"\n🔍 Testing Delete Student: {cedula}...")
        response = self.make_request('DELETE', f'/estudiantes/{cedula}', expected_status=200)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data:
                    self.log_result("Delete Student", True)
                    return True
                else:
                    self.log_result("Delete Student", False, "No success message")
            except:
                self.log_result("Delete Student", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Delete Student", False, f"Status code: {status}", 200, status)
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting SAE Backend API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        
        # Basic connectivity
        if not self.test_health_check():
            print("\n❌ Health check failed - stopping tests")
            return self.generate_summary()
        
        # Authentication tests
        if not self.test_login():
            print("\n❌ Login failed - stopping tests")
            return self.generate_summary()
        
        self.test_invalid_login()
        self.test_auth_me()
        
        # Student management tests
        test_student = self.test_create_student()
        if test_student:
            cedula = test_student['cedula']
            
            # Test student operations
            self.test_get_students()
            self.test_get_student_by_cedula(cedula)
            self.test_update_student(cedula)
            
            # QR and attendance tests
            self.test_generate_qr(cedula)
            self.test_create_attendance_record(cedula)
            
            # Cleanup
            self.test_delete_student(cedula)
        
        # Records and stats tests
        self.test_get_attendance_records()
        self.test_get_today_records()
        self.test_get_stats()
        
        # Reporting and admin tests
        self.test_generate_pdf_report()
        self.test_register_admin()
        
        return self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print(f"\n" + "="*60)
        print(f"🏁 SAE API TEST SUMMARY")
        print(f"="*60)
        print(f"📊 Tests Run: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    """Main test runner"""
    tester = SAEAPITester()
    results = tester.run_all_tests()
    
    # Return exit code based on success rate
    return 0 if results["success_rate"] >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())