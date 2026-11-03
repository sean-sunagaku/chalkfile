"""音の道具の部品（scripts/ の Python の道具が import する）。

python scripts/<道具>.py で流すと、sys.path の頭が scripts/ になるので、audio.common のように読める。
ふつうのパッケージ（この __init__.py がある）にして、ほかに入っている同じ名前のパッケージより先に、ここを読ませる。
"""
