import re

def check(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    
    # remove comments and strings (simplified)
    content = "".join(lines)
    
    # Simple parser state machine
    in_string = False
    string_char = ''
    in_comment = False # /* */
    in_line_comment = False # //
    
    i = 0
    line_num = 1
    col_num = 0
    
    while i < len(content):
        char = content[i]
        
        if char == '\n':
            line_num += 1
            col_num = 0
            in_line_comment = False
            i += 1
            continue
            
        col_num += 1
        
        if in_line_comment:
            i += 1
            continue
            
        if in_comment:
            if char == '*' and i+1 < len(content) and content[i+1] == '/':
                in_comment = False
                i += 2
                col_num += 1
                continue
            i += 1
            continue
            
        if in_string:
            if char == '\\':
                i += 2 # skip escape
                col_num += 1
                continue
            if char == string_char:
                in_string = False
            i += 1
            continue
            
        # check for comments starting
        if char == '/' and i+1 < len(content):
            if content[i+1] == '/':
                in_line_comment = True
                i += 2
                col_num += 1
                continue
            if content[i+1] == '*':
                in_comment = True
                i += 2
                col_num += 1
                continue
                
        # check for strings starting
        if char in ["'", '"', '`']:
            in_string = True
            string_char = char
            i += 1
            continue
            
        # check brackets
        if char in ['(', '{', '[']:
            stack.append((char, line_num, col_num))
        elif char in [')', '}', ']']:
            if not stack:
                print(f"Error: Unexpected '{char}' at line {line_num}:{col_num}")
                return
            last, l, c = stack.pop()
            expected = {'(':')', '{':'}', '[':']'}[last]
            if char != expected:
                print(f"Error: Mismatched '{char}' at line {line_num}:{col_num}. Expected '{expected}' (opened at {l}:{c})")
                return
        
        i += 1
        
    if stack:
        print(f"Error: Unclosed items: {stack[0]}")
    else:
        print("Syntax OK")

check(r'e:\\Projects\\AnomalyBot\\anomaly-worker\\src\\server.js')
