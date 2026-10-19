
from spyne import ComplexModel, Integer, Unicode
from spyne import Decimal as SpyneDecimal


class Employee(ComplexModel):
    __namespace__ = "http://example.com/calculator"

    employee_id = Integer
    name = Unicode
    salary = SpyneDecimal
