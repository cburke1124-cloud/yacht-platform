import inspect
import error_handler
with open('error_handler_dump.txt','w',encoding='utf-8') as f:
    f.write('MODULE: '+repr(error_handler)+'\n\n')
    try:
        src = inspect.getsource(error_handler.validation_exception_handler)
    except Exception as e:
        src = 'could not get source: '+str(e)
    f.write(src)
    f.write('\n\nFULL_FILE:\n')
    try:
        src2 = inspect.getsource(error_handler)
    except Exception as e:
        src2 = 'could not get source: '+str(e)
    f.write(src2)
print('dump written to error_handler_dump.txt')
