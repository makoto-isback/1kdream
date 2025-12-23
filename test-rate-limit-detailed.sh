#!/bin/bash

# ============================================
# Detailed Rate Limiting Test
# ============================================
# Tests rapid requests to verify throttling
# ============================================

API_URL="${API_URL:-https://adream-backend-production.up.railway.app}"
TOKEN="${TOKEN:-your-jwt-token-here}"

if [ "$TOKEN" = "your-jwt-token-here" ]; then
  echo "⚠️  Warning: Using placeholder token. Set TOKEN environment variable for accurate testing."
  echo ""
fi

echo "🚦 Testing Rate Limiting with Rapid Requests..."
echo "================================================"
echo ""
echo "Making 150 requests to: $API_URL/lottery/active"
echo "Expected: First ~100 should succeed, then throttled (429)"
echo ""

# Counters
success_count=0
throttled_count=0
error_count=0
other_count=0

# Make 150 requests
for i in {1..150}; do
  # Make request and capture status code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "$API_URL/lottery/active" \
    -H "Authorization: Bearer $TOKEN" 2>&1)
  
  # Count by status
  case "$status_code" in
    200)
      success_count=$((success_count + 1))
      if [ $i -le 10 ] || [ $i -eq 50 ] || [ $i -eq 100 ]; then
        echo "Request $i: ✅ Success (200)"
      fi
      ;;
    429)
      throttled_count=$((throttled_count + 1))
      if [ $throttled_count -eq 1 ]; then
        echo "Request $i: ⚠️  FIRST THROTTLE (429) - Rate limit hit!"
      fi
      ;;
    401)
      error_count=$((error_count + 1))
      if [ $error_count -eq 1 ]; then
        echo "Request $i: ❌ Unauthorized (401) - Token may be invalid"
      fi
      ;;
    *)
      other_count=$((other_count + 1))
      if [ $other_count -eq 1 ]; then
        echo "Request $i: ⚠️  Unexpected status: $status_code"
      fi
      ;;
  esac
  
  # Small delay to avoid overwhelming
  sleep 0.05
done

echo ""
echo "================================================"
echo "📊 Rate Limiting Test Results"
echo "================================================"
echo "✅ Successful (200): $success_count"
echo "⚠️  Throttled (429): $throttled_count"
echo "❌ Errors (401/other): $((error_count + other_count))"
echo ""

# Analysis
if [ $throttled_count -gt 0 ]; then
  echo "✅ Rate limiting is WORKING - requests were throttled"
  if [ $success_count -le 110 ] && [ $success_count -ge 90 ]; then
    echo "✅ Limit appears correct (~100 requests allowed)"
  else
    echo "⚠️  Limit may be different than expected (got $success_count successful)"
  fi
else
  echo "❌ Rate limiting may NOT be working - no throttled requests"
fi

echo ""
echo "Test complete!"

