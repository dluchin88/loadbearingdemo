import requests
import sys
import json
from datetime import datetime

class TexasWholesalingAPITester:
    def __init__(self):
        self.base_url = "https://ai-twin-finder.preview.emergentagent.com/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                "test": name,
                "endpoint": url,
                "method": method,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "description": description
            }
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # For successful GET requests, validate response has expected keys
                if method == 'GET' and response.status_code == 200:
                    try:
                        response_data = response.json()
                        result["response_data"] = response_data
                        
                        # Validate specific endpoints
                        if endpoint == "dashboard/stats":
                            required_keys = ["pipeline_value", "hot_leads", "calls_today", "active_buyers"]
                            missing_keys = [k for k in required_keys if k not in response_data]
                            if missing_keys:
                                print(f"⚠️  Missing keys in dashboard stats: {missing_keys}")
                                result["warnings"] = f"Missing keys: {missing_keys}"
                        
                        elif endpoint == "agents":
                            if isinstance(response_data, list) and len(response_data) > 0:
                                expected_agents = ["Zara", "Ace", "Maya", "Eli", "Nova", "Raven", "Jett", "Sage", "Finn", "Luna", "Blaze"]
                                actual_agents = [agent.get("name") for agent in response_data]
                                print(f"   Found {len(actual_agents)} agents: {', '.join(actual_agents)}")
                                if len(actual_agents) != 11:
                                    result["warnings"] = f"Expected 11 agents, got {len(actual_agents)}"
                        
                        elif endpoint in ["leads", "deals", "buyers", "calls"]:
                            count = len(response_data) if isinstance(response_data, list) else 0
                            print(f"   Found {count} {endpoint}")
                            result["count"] = count
                            
                    except json.JSONDecodeError:
                        print(f"⚠️  Response is not valid JSON")
                        result["warnings"] = "Invalid JSON response"
                        
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                    result["error_detail"] = error_detail
                except:
                    print(f"   Raw response: {response.text[:200]}")
                    result["error_text"] = response.text[:200]

            self.test_results.append(result)
            return success, response.json() if success else {}

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            result = {
                "test": name,
                "endpoint": url,
                "method": method,
                "expected_status": expected_status,
                "actual_status": "Network Error",
                "success": False,
                "error": str(e),
                "description": description
            }
            self.test_results.append(result)
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test(
            "Root Endpoint", 
            "GET", 
            "", 
            200, 
            description="Check if API is accessible"
        )

    def test_seed_data(self):
        """Test seeding initial data"""
        return self.run_test(
            "Seed Data",
            "POST",
            "seed",
            200,
            description="Initialize database with test data"
        )

    def test_get_agents(self):
        """Test getting all agents"""
        return self.run_test(
            "Get Agents",
            "GET",
            "agents",
            200,
            description="Fetch all 11 AI agents"
        )

    def test_get_leads(self):
        """Test getting all leads"""
        return self.run_test(
            "Get Leads",
            "GET", 
            "leads",
            200,
            description="Fetch leads pipeline"
        )

    def test_get_deals(self):
        """Test getting all deals"""
        return self.run_test(
            "Get Deals",
            "GET",
            "deals", 
            200,
            description="Fetch all deals"
        )

    def test_get_buyers(self):
        """Test getting all buyers"""
        return self.run_test(
            "Get Buyers",
            "GET",
            "buyers",
            200,
            description="Fetch cash buyers list"
        )

    def test_get_call_logs(self):
        """Test getting call logs"""  
        return self.run_test(
            "Get Call Logs",
            "GET",
            "calls",
            200,
            description="Fetch call history"
        )

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        return self.run_test(
            "Dashboard Stats",
            "GET", 
            "dashboard/stats",
            200,
            description="Fetch dashboard metrics"
        )

    def test_mao_calculator(self):
        """Test MAO calculator endpoint"""
        test_data = {
            "arv": 200000,
            "rehab_estimate": 35000,
            "assignment_fee": 10000
        }
        success, response = self.run_test(
            "MAO Calculator",
            "POST",
            "calculator/mao",
            200,
            data=test_data,
            description="Calculate Maximum Allowable Offer"
        )
        
        if success and "max_allowable_offer" in response:
            expected_mao = (200000 * 0.70) - 35000 - 10000  # Should be 95000
            actual_mao = response["max_allowable_offer"]
            print(f"   MAO Calculation: ${actual_mao:,.2f} (Expected: ${expected_mao:,.2f})")
            if abs(actual_mao - expected_mao) > 1:  # Allow small rounding differences
                print(f"⚠️  MAO calculation mismatch")
        
        return success, response

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r["success"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']} - {test.get('error', 'Status: ' + str(test['actual_status']))}")
        
        # Show warnings
        warned_tests = [r for r in self.test_results if r.get("warnings")]
        if warned_tests:
            print(f"\n⚠️  WARNINGS:")
            for test in warned_tests:
                print(f"   • {test['test']} - {test['warnings']}")

def main():
    print("🏢 Texas Wholesaling Cold Call Command Center - API Testing")
    print("=" * 60)
    
    tester = TexasWholesalingAPITester()

    # Run all tests in logical order
    tests = [
        tester.test_root_endpoint,
        tester.test_seed_data,  # Seed first to ensure data exists
        tester.test_get_agents,
        tester.test_get_leads, 
        tester.test_get_deals,
        tester.test_get_buyers,
        tester.test_get_call_logs,
        tester.test_dashboard_stats,
        tester.test_mao_calculator
    ]

    for test_func in tests:
        success, _ = test_func()
        if not success and test_func.__name__ == "test_root_endpoint":
            print("\n💥 CRITICAL: API is not accessible. Stopping tests.")
            tester.print_summary()
            return 1

    tester.print_summary()
    
    # Return success only if all critical tests pass
    critical_failures = sum(1 for r in tester.test_results if not r["success"] and r["test"] in [
        "Root Endpoint", "Get Agents", "Dashboard Stats"
    ])
    
    return 0 if critical_failures == 0 else 1

if __name__ == "__main__":
    sys.exit(main())