import sys
sys.path.insert(0, r'c:\Users\cburk\yacht-platform\backend')
import main
print('rate_limit is', main.rate_limit)
print('RateLimitMiddleware is', main.RateLimitMiddleware)
print('app middlewares:')
for m in main.app.user_middleware:
    print(' ', m)
